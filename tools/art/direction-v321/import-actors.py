"""Read original PNG alpha to register poses. Image bytes are never altered.

Imports accepted generated32/16-pose atlases. Native crop rectangles and
per-pose pivots keep transparent padding out of the registered body area.
"""
from pathlib import Path
import argparse, copy, hashlib, json, statistics
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
DIRS=['down','left','right','up']

def bands(values,minimum,merge=5):
    rows=[];start=None
    for i,value in enumerate(values+[0]):
        if value>minimum and start is None:start=i
        if value<=minimum and start is not None:rows.append([start,i]);start=None
    merged=[]
    for start,end in rows:
        if merged and start-merged[-1][1]<=merge:merged[-1][1]=end
        else:merged.append([start,end])
    return merged

def analyze(path,columns=8):
    im=Image.open(path).convert('RGBA');w,h=im.size;a=im.getchannel('A');alpha=a.load()
    rows=bands([sum(v>=192 for v in a.crop((0,y,w,y+1)).get_flattened_data())for y in range(h)],max(10,w//120),1)
    assert len(rows)==4,('Expected four direction rows',path,rows)
    result=[]
    for row,(top,bottom)in enumerate(rows):
        cols=bands([sum(v>=192 for v in a.crop((x,top,x+1,bottom)).get_flattened_data())for x in range(w)],max(2,(bottom-top)//120),5)
        assert len(cols)==columns,('Expected separated pose columns',path,row,cols)
        entries=[]
        for col,(left,right)in enumerate(cols):
            pixels=a.crop((left,top,right,bottom));box=pixels.point(lambda v:255 if v>=192 else 0).getbbox();assert box
            x0=left+box[0];y0=top+box[1];x1=left+box[2];y1=top+box[3]
            torso=[]
            for y in range(y0+round((y1-y0)*.22),y0+round((y1-y0)*.44)):
                torso.extend(x for x in range(x0,x1)if alpha[x,y]>=192)
            center=statistics.median(torso)if torso else(x0+x1)/2
            # Preserve the immutable PNG, selecting only this pose's native area.
            x0=max(0,x0-2);y0=max(0,y0-2);x2=min(w,x1+2);y2=min(h,y1+2)
            entries.append({'frame':[x0,y0,x2-x0,y2-y0],'anchor':[(center-x0)/(x2-x0),(y1-y0)/(y2-y0)],'bodyHeight':y1-y0,'row':row,'column':col})
        result.append(entries)
    return result

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--install',action='store_true');args=parser.parse_args()
    plan=json.loads((HERE/'actor-plan.json').read_text());m=json.loads((ROOT/'src/client/sprites.json').read_text());fragment={'sheets':{},'frames':{},'chars':{}};audit=[]
    for design in plan:
        role=design['id'];path=ROOT/'public/sprites/original/direction-v321'/design['file'];poses=analyze(path)
        sheet='av321_'+role;fragment['sheets'][sheet]=str(path.relative_to(ROOT/'public'))
        ch=copy.deepcopy(m['chars'][design['bindings'][0]]);ch['walk']={};ch['idle']={};ch.pop('attack',None);ch.pop('attackAnchor',None)
        ch['frameTransforms']={};ch['anchor']=[.5,1];ch['headOffset']=design.get('height',31)+2
        scale=design.get('height',31)/statistics.median(p['bodyHeight']for row in poses for p in row)
        ch['renderScale']=scale
        for direction,row in zip(DIRS,poses):
            ch['walk'][direction]=[];ch['idle'][direction]=[]
            for i,pose in enumerate(row):
                mode='walk'if i<6 else'idle';index=i if i<6 else i-6;key=f'av321_{role}_{mode}_{direction}{index}'
                fragment['frames'][key]=[sheet,*pose['frame']];ch[mode][direction].append(key);ch['frameTransforms'][key]={'anchor':pose['anchor'],'scale':scale}
        if design.get('attack'):
            attack=design['attack'];apath=ROOT/'public/sprites/original/direction-v321'/attack['file'];asheet='av321_'+attack['sheet'];fragment['sheets'][asheet]=str(apath.relative_to(ROOT/'public'))
            attackPoses=analyze(apath,attack.get('columns',4));start=attack.get('start',0);attackScale=design.get('height',31)/statistics.median(p['bodyHeight']for row in attackPoses for p in row[start:start+4]);ch['attack']={}
            for direction,row in zip(DIRS,attackPoses):
                ch['attack'][direction]=[]
                for i,pose in enumerate(row[start:start+4]):
                    key=f'av321_{role}_attack_{direction}{i}';fragment['frames'][key]=[asheet,*pose['frame']];ch['attack'][direction].append(key);ch['frameTransforms'][key]={'anchor':pose['anchor'],'scale':attackScale}
        for binding in design['bindings']:
            assigned=copy.deepcopy(ch);portrait=m['chars'][binding].get('portrait',ch.get('portrait'))
            if portrait:assigned['portrait']=portrait
            else:assigned.pop('portrait',None)
            ratio=design.get('bindingHeights',{}).get(binding,design.get('height',31))/design.get('height',31)
            assigned['renderScale']*=ratio;assigned['headOffset']*=ratio
            for transform in assigned['frameTransforms'].values():transform['scale']*=ratio
            if binding=='tender_drone_inert':
                assigned.pop('attack',None)
                for mode in ['walk','idle']:assigned[mode]={d:[assigned['idle'][d][0]]for d in DIRS}
            fragment['chars'][binding]=assigned
        audit.append({'id':role,'bindings':design['bindings'],'source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'scale':scale,'heightWorld':design.get('height',31),'poses':poses,'attack':design.get('attack')})
    (HERE/'actors.fragment.json').write_text(json.dumps(fragment,indent=2)+'\n');(HERE/'actor-frame-audit.json').write_text(json.dumps({'method':'Alpha192 registration only; PNG bytes unchanged','designs':audit},indent=2)+'\n')
    if args.install:
        for group in ['sheets','frames','chars']:m[group].update(fragment[group])
        (ROOT/'src/client/sprites.json').write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps({'designs':len(plan),'registrations':len(fragment['chars']),'frames':len(fragment['frames']),'installed':args.install}))

if __name__=='__main__':main()
