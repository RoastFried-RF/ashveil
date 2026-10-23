"""Reviewed facing corrections, renderer metadata only. Preserved PNGs are never changed."""
import copy

def repair(role,clips,frames,transforms):
 corrections=[]
 def flip(mode,direction):
  for key in clips.get(mode,{}).get(direction,[]):
   transforms[key]['flipX']=not transforms[key].get('flipX',False);transforms[key].pop('mainHand',None)
  corrections.append({'mode':mode,'direction':direction,'kind':'flip-original'})
 def mirror(mode,target,source):
  for key,original in zip(clips.get(mode,{}).get(target,[]),clips.get(mode,{}).get(source,[])):
   frames[key]=copy.deepcopy(frames[original]);transforms[key]=copy.deepcopy(transforms[original]);transforms[key]['flipX']=not transforms[key].get('flipX',False)
  corrections.append({'mode':mode,'direction':target,'kind':'mirror-reviewed-side','sourceDirection':source})
 # Reaver melee source already has a correct left profile; others use a reviewed opposite profile.
 for mode in ['attack','block','hurt']:
  if role=='amalgam':mirror(mode,'right','left')
  elif role!='reaver':mirror(mode,'left','right')
 for mode in ['crouchWalk','work','use']:
  if role=='amalgam':mirror(mode,'right','left')
  if role=='guard'or role=='wanderer'and mode=='crouchWalk':flip(mode,'left')
  if role in ['healer','hound']and mode in ['work','use']:flip(mode,'left')
  if role in ['trader','rat']and mode=='crouchWalk':flip(mode,'left')
 if role=='reaver':
  for mode in ['shoot','throw','interact']:
   for direction in ['left','right']:flip(mode,direction)
 else:
  if role=='worker':
   for mode in ['throw','interact']:flip(mode,'right')
  for mode in ['shoot','throw','interact']:
   if mode in clips:mirror(mode,'left','right')
 return corrections
