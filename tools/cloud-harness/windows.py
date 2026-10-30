"""Windows-only locks and owned Job Objects. No shell or third-party modules."""
import contextlib
import ctypes
from ctypes import wintypes
import errno
import msvcrt
import os
import subprocess


def try_lock(fd):
    os.lseek(fd, 0, os.SEEK_SET)
    try:
        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        return True
    except OSError as error:
        if error.errno not in (errno.EACCES, errno.EAGAIN, errno.EDEADLK):
            raise
        return False


@contextlib.contextmanager
def acquire_windows(root, lane, stop):
    # The gate serializes admission. Heavy holds BOTH light slots and the gate;
    # light releases the gate after claiming one slot. Closing releases OS locks.
    def open_lock(name):
        return os.open(root / name, os.O_RDWR | os.O_CREAT | os.O_BINARY, 0o600)

    while not stop.is_set():
        held = []
        admitted = False
        try:
            gate = open_lock("heavy-gate.lock")
            held.append(gate)
            if try_lock(gate):
                for index in range(2):
                    slot = open_lock(f"light-{index}.lock")
                    held.append(slot)
                    if try_lock(slot):
                        if lane == "light":
                            os.close(gate)
                            held.remove(gate)
                            admitted = True
                            break
                        if index == 1:
                            admitted = True
                    else:
                        os.close(slot)
                        held.remove(slot)
                        if lane == "heavy":
                            break
            if admitted:
                yield
                return
        finally:
            for fd in reversed(held):
                os.close(fd)
        stop.wait(0.05)
    raise InterruptedError("Runner cancelled before acquiring resource lock")


class BasicLimit(ctypes.Structure):
    _fields_ = [("processTime", ctypes.c_int64), ("jobTime", ctypes.c_int64),
                ("flags", wintypes.DWORD), ("minWorkingSet", ctypes.c_size_t),
                ("maxWorkingSet", ctypes.c_size_t), ("activeProcesses", wintypes.DWORD),
                ("affinity", ctypes.c_size_t), ("priority", wintypes.DWORD),
                ("scheduling", wintypes.DWORD)]


class IoCounters(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint64) for name in
                ("readOps", "writeOps", "otherOps", "readBytes", "writeBytes", "otherBytes")]


class ExtendedLimit(ctypes.Structure):
    _fields_ = [("basic", BasicLimit), ("io", IoCounters),
                ("processMemory", ctypes.c_size_t), ("jobMemory", ctypes.c_size_t),
                ("peakProcessMemory", ctypes.c_size_t), ("peakJobMemory", ctypes.c_size_t)]


kernel = ctypes.WinDLL("kernel32", use_last_error=True)
kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
kernel.CreateJobObjectW.restype = wintypes.HANDLE
kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
kernel.SetInformationJobObject.restype = wintypes.BOOL
kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
kernel.AssignProcessToJobObject.restype = wintypes.BOOL
kernel.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
kernel.TerminateJobObject.restype = wintypes.BOOL
kernel.CloseHandle.argtypes = [wintypes.HANDLE]
kernel.CloseHandle.restype = wintypes.BOOL
nt = ctypes.WinDLL("ntdll")
nt.NtResumeProcess.argtypes = [wintypes.HANDLE]
nt.NtResumeProcess.restype = ctypes.c_long


class WindowsProcess:
    """Assign a suspended child BEFORE it can create descendants, then resume.

    Closing the non-inheritable job kills only this command's entire tree,
    including descendants whose immediate parent has already exited.
    """
    def __init__(self, argv, **kwargs):
        self.job = kernel.CreateJobObjectW(None, None)
        if not self.job:
            raise ctypes.WinError(ctypes.get_last_error())
        self.process = None
        try:
            limits = ExtendedLimit()
            limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if not kernel.SetInformationJobObject(self.job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
                raise ctypes.WinError(ctypes.get_last_error())
            self.process = subprocess.Popen(argv, creationflags=0x4 | subprocess.CREATE_NEW_PROCESS_GROUP,
                                            **kwargs)  # CREATE_SUSPENDED
            if not kernel.AssignProcessToJobObject(self.job, int(self.process._handle)):
                raise ctypes.WinError(ctypes.get_last_error())
            status = nt.NtResumeProcess(int(self.process._handle))
            if status != 0:
                raise OSError(f"NtResumeProcess failed: {status:#x}")
        except BaseException:
            if self.process is not None:
                self.process.kill()
                self.process.wait()
            self.stop_tree()
            raise

    def __getattr__(self, name):
        return getattr(self.process, name)

    def stop_tree(self):
        if self.job:
            kernel.TerminateJobObject(self.job, 1)
            kernel.CloseHandle(self.job)
            self.job = None
