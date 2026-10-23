"""Read-only alpha registration of generated32-pose PNGs; preserve source bytes."""
from pathlib import Path
import argparse,hashlib,json,shutil
from read_atlas import analyze
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--id',required=True);parser.add_argument('--original',required=True);parser.add_argument('--retry',action='store_true');parser.add_argument('--prompt-file');parser.add_argument('--layout');args=parser.parse_args()
plan=json.loads((HERE/'generation-plan.json').read_text());job=next(j for j in plan if j['id']==args.id)
original=Path(args.original).resolve();assert original.parent==Path('/workspace/generated_images') and original.suffix=='.png'
source=HERE/'sources'/(args.id+'.json');source.parent.mkdir(exist_ok=True);prior=json.loads(source.read_text())if source.exists()else{'attempts':[]}
attempt={'original':str(original),'sha256':hashlib.sha256(original.read_bytes()).hexdigest(),'input':job['input'],'prompt':Path(args.prompt_file).read_text() if args.prompt_file else (job.get('retryPrompt',job['prompt'])if args.retry else job['prompt'])}
if args.layout:attempt['layout']=args.layout
try:
 poses=analyze(original,8);target=ROOT/'public/sprites/original/direction-v322'/(args.id+'.png');target.parent.mkdir(exist_ok=True)
 shutil.copyfile(original,target);assert hashlib.sha256(target.read_bytes()).hexdigest()==attempt['sha256']
 attempt.update({'accepted':True,'installed':str(target.relative_to(ROOT)),'poses':poses})
except Exception as error:attempt.update({'accepted':False,'installed':None,'reason':str(error)})
prior['attempts'].append(attempt);prior.update({'id':job['id'],'role':job['role'],'mode':job['mode'],'directions':job['directions'],'accepted':attempt['accepted']})
source.write_text(json.dumps(prior,indent=2)+'\n');print(json.dumps({'id':args.id,'accepted':attempt['accepted'],'attempts':len(prior['attempts']),'reason':attempt.get('reason','')[:500]}))
