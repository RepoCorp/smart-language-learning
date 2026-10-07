from .catalog import DEFINITIONS
from .evaluations import PREPARERS


DEFINITIONS_BY_KEY = {(definition.language, definition.key): definition for definition in DEFINITIONS}
REVIEW_DIRECTIONS = {"es_to_de": "source_to_target", "de_to_es": "target_to_source"}


def evaluation_payload(item, direction, version):
    definition = DEFINITIONS_BY_KEY.get((item.target_language, item.pattern_key))
    if not definition:
        return {}
    evaluation_id = definition.evaluations.get(REVIEW_DIRECTIONS.get(direction))
    if not evaluation_id:
        return {}
    prepare = PREPARERS.get(evaluation_id)
    return {"learning_evaluation": {
        "id": evaluation_id,
        "content": prepare(definition, item.source_language, version) if prepare else None,
    }}
