"""생성한 Def JSON Schema를 독립 구현으로 검증한다. python3 tools/validate-schema.py"""
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit('jsonschema가 필요합니다: python3 -m pip install -r tools/requirements-schema.txt')

root = Path(__file__).resolve().parent.parent
schema = json.loads((root / 'docs/schema/defs.schema.json').read_text())
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
files = sorted((root / 'src/content').glob('**/defs/*.json')) + sorted((root / 'mods').glob('**/defs/*.json'))
errors = []
for file in files:
    for error in validator.iter_errors(json.loads(file.read_text())):
        errors.append(f'{file.relative_to(root)} {error.json_path}: {error.message[:180]}')
for value in [
    [{'defType': 'Bogus', 'id': 'Bad'}],
    [{'defType': 'Item', 'id': 'Bad', 'parent': 'Item.Note', 'book': {'pages': 'forty', 'mastery': 'medicine', 'amount': 5}}],
    [{'defType': 'Creature', 'id': 'Creature.Bad', 'parent': 'Creature.Reaver', 'diseaseImmune': {'$append': 'bad'}}],
    [{'defType': 'Creature', 'id': 'Creature.Bad', 'parent': 'Creature.Reaver', 'diseaseImmune': {'$append': [5]}}],
]:
    if not list(validator.iter_errors(value)):
        errors.append('오류를 포함한 검증용 Def를 통과시켰습니다')
if list(validator.iter_errors([{'defType': 'Item', 'id': 'Child', 'parent': 'Item.Note'}])):
    errors.append('상속받는 자식 Def를 거부했습니다')
for value in [
    [{'defType': 'Creature', 'id': 'Creature.Child', 'parent': 'Creature.Reaver', 'diseaseImmune': {'$append': ['Disease.GreyFever']}, 'description': None}],
    [{'defType': 'Item', 'id': 'Item.Child', 'parent': 'Item.Note', 'book': {'$inherit': False, 'pages': 40}}],
]:
    if list(validator.iter_errors(value)):
        errors.append('배열 합성/삭제/객체 교체를 사용하는 자식 Def를 거부했습니다')
for error in errors:
    print(error, file=sys.stderr)
print(f'JSON Schema: {len(files)}개 파일 · 오류 {len(errors)}개')
sys.exit(1 if errors else 0)
