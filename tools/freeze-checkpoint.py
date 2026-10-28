"""검증용 불변 스냅샷. 동일 파일은 이전 스냅샷에서만 hardlink하고 작업본은 연결하지 않는다."""
from pathlib import Path
import argparse, hashlib, json, os, shutil

GROUPS = ['src', 'dist', 'tests', 'tools', 'docs', 'public', 'mods', '.agents', '.github']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def freeze(source, output, reuse=None):
    source, output = source.resolve(), output.resolve()
    reuse = reuse.resolve() if reuse else None
    if output.exists() or output.with_name(output.name + '-manifest.json').exists():
        raise ValueError('기존 스냅샷/명세를 덮어쓰지 않는다')
    if source == reuse or source in output.parents or (reuse and (output == reuse or reuse in output.parents)):
        raise ValueError('작업본과 검증본은 별도 디렉터리여야 한다')
    if reuse and not reuse.is_dir():
        raise ValueError('재사용할 이전 스냅샷이 없다')
    for name in GROUPS:
        if not (source / name).is_dir():
            raise ValueError('필수 디렉터리가 없다: ' + name)
    files = sorted([p for name in GROUPS for p in (source / name).rglob('*') if p.is_file()] + [p for p in source.iterdir() if p.is_file()])
    rows, linked, copied, avoided = {}, 0, 0, 0
    output.mkdir(parents=True)
    try:
        for path in files:
            relative = path.relative_to(source)
            if path.is_symlink():
                raise ValueError('원본 파일 심볼릭 링크는 복사하지 않는다: ' + str(relative))
            checksum, target = digest(path), output / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            prior = reuse / relative if reuse else None
            if prior and prior.is_file() and not prior.is_symlink() and not os.path.samefile(path, prior) and digest(prior) == checksum:
                try:
                    os.link(prior, target)
                    linked += 1
                    avoided += path.stat().st_size
                except OSError:
                    shutil.copy2(path, target)
                    copied += 1
            else:
                shutil.copy2(path, target)
                copied += 1
            if os.path.samefile(path, target) or digest(target) != checksum:
                raise ValueError('작업본 연결 또는 복사 불일치: ' + str(relative))
            rows[str(relative)] = checksum
        # 복사 중 원본이 바뀌었거나 추가/삭제됐다면 혼합 스냅샷을 남기지 않는다.
        current = sorted([p for name in GROUPS for p in (source / name).rglob('*') if p.is_file()] + [p for p in source.iterdir() if p.is_file()])
        if current != files or any(digest(source / name) != value for name, value in rows.items()):
            raise ValueError('스냅샷 중 원본이 바뀌었다')
        (output / 'node_modules').symlink_to(source / 'node_modules', target_is_directory=True)
        manifest = output.with_name(output.name + '-manifest.json')
        manifest.write_text(json.dumps(rows, indent=2) + '\n')
        return {'checkpoint': str(output), 'files': len(rows), 'copied': copied, 'linkedFromImmutablePrevious': linked, 'duplicateBytesAvoided': avoided, 'noWorkingSourceHardlinks': True, 'manifest': str(manifest)}
    except BaseException:
        shutil.rmtree(output)
        output.with_name(output.name + '-manifest.json').unlink(missing_ok=True)
        raise

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path.cwd())
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--reuse', type=Path)
    args = parser.parse_args()
    print(json.dumps(freeze(args.source, args.output, args.reuse), ensure_ascii=False))
