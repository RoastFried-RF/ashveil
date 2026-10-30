"""Report every complete-state difference before a separately reviewed golden update."""
import argparse
import collections
import hashlib
import json
import copy
import re
from pathlib import Path


def differences(a, b, path=''):
    if type(a) is not type(b):
        yield {'path': path, 'before': a, 'after': b}
    elif isinstance(a, dict):
        for key in sorted(a.keys() | b.keys()):
            here = path + '/' + key.replace('~', '~0').replace('/', '~1')
            if key not in a:
                yield {'path': here, 'added': b[key]}
            elif key not in b:
                yield {'path': here, 'removed': a[key]}
            else:
                yield from differences(a[key], b[key], here)
    elif isinstance(a, list):
        if len(a) != len(b):
            yield {'path': path + '/length', 'before': len(a), 'after': len(b)}
        for index in range(min(len(a), len(b))):
            yield from differences(a[index], b[index], path + '/' + str(index))
        for index in range(len(a), len(b)):
            yield {'path': path + '/' + str(index), 'added': b[index]}
        for index in range(len(b), len(a)):
            yield {'path': path + '/' + str(index), 'removed': a[index]}
    elif a != b:
        yield {'path': path, 'before': a, 'after': b}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('after', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--ash-supply-v408', action='store_true', help='Assert the separately reviewed v408 metadata and finite stock changes')
    args = parser.parse_args()
    old_bytes, new_bytes = args.before.read_bytes(), args.after.read_bytes()
    old, new = json.loads(old_bytes), json.loads(new_bytes)
    assert [row['name'] for row in old] == [row['name'] for row in new]
    rows = []
    for before, after in zip(old, new):
        if args.ash_supply_v408:
            for stage in ['initial', 'state']:
                original, actual = before[stage], after[stage]
                expected = copy.deepcopy(original)
                assert original['version'] == 220 and actual['version'] == 221
                expected['version'] = 221
                for field in ['loadHash']:
                    assert re.fullmatch(r'sha256-[0-9a-f]{64}', actual[field])
                    expected[field] = actual[field]
                assert re.fullmatch(r'sha256-[0-9a-f]{64}', actual['contentMods'][0]['hash'])
                expected['contentMods'][0]['hash'] = actual['contentMods'][0]['hash']
                expected['contentDefinitions'].update({'AshDeposit.Pilgrim': 'AshDeposit', 'Terrain.PilgrimAshDrift': 'Terrain'})
                if 'overworld' in expected:
                    world = expected['overworld']
                    stock = world['markets']['Region.Stillhouse']
                    uid = stock['items'][-1]['uid'] + 1
                    added = [('Item.Oats', 5), ('Item.Oats', 3), *[('Item.Bowl', 1)]*4, ('Item.Wood', 3), ('Item.Wood', 3), ('Item.Wood', 2), ('Item.CampfireKit', 1)]
                    stock['items'].extend(dict(uid=uid+i, def_=item, count=count) for i, (item, count) in enumerate(added))
                    for item in stock['items'][-10:]:
                        item['def'] = item.pop('def_')
                    stock['adoptedStockAdditions'].append('Stock.pilgrims/ash-workshop-v408')
                    for site in ['Region.ShadeBasin', 'Region.ShadeGrove', 'Region.ShadeHollow']:
                        for item in world['markets'][site]['items'][8:10]:
                            item['uid'] += 10
                    world['simulation']['nextItemId'] += 10
                assert expected == actual, before['name'] + '/' + stage + ': unreviewed complete-state change'
            assert before['errors'] == after['errors']
        initial = list(differences(before['initial'], after['initial']))
        final = list(differences(before['state'], after['state']))
        rows.append(dict(name=before['name'], commands=len(before['errors']),
                         errorsUnchanged=before['errors'] == after['errors'],
                         initial=initial, final=final))
    report = dict(reportOnly=not args.ash_supply_v408, reviewedShape='ash-supply-v408' if args.ash_supply_v408 else None, beforeSha256=hashlib.sha256(old_bytes).hexdigest(),
                  afterSha256=hashlib.sha256(new_bytes).hexdigest(), rows=rows)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    for row in rows:
        counts = collections.Counter(diff['path'].split('/')[1] for diff in row['initial'] + row['final'])
        print(json.dumps(dict(name=row['name'], errorsUnchanged=row['errorsUnchanged'],
                              initial=len(row['initial']), final=len(row['final']), fields=counts), ensure_ascii=False))


if __name__ == '__main__':
    main()
