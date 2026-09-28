from datetime import datetime, timedelta, timezone as dt_timezone
from importlib import import_module

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from learning.models import Item, UserTimezonePreference


@pytest.mark.django_db(transaction=True)
def test_migration_preserves_production_progress_without_copying_it_to_recognition(monkeypatch):
    module = import_module("learning.migrations.0047_patterns_as_items")
    state = MigrationExecutor(connection).loader.project_state([("learning", "0046_word_formation_progress")])
    # Use the historical models at the data-migration boundary, without changing migration records.
    for operation in module.Migration.operations[:5]:
        operation.state_forwards("learning", state)
    Progress = state.apps.get_model("learning", "WordFormationProgress")
    user = get_user_model().objects.create_user(username="migrated-patterns")
    UserTimezonePreference.objects.create(user=user, timezone="America/Bogota")
    now = datetime(2026, 9, 27, 2, tzinfo=dt_timezone.utc)
    monkeypatch.setattr(module.timezone, "now", lambda: now)
    due = datetime(2026, 9, 27, 5, tzinfo=dt_timezone.utc)
    with connection.schema_editor() as schema:
        schema.create_model(Progress)
    try:
        Progress.objects.create(user_id=user.id, source_language="spanish", target_language="english",
                                pattern_key="english_suffix_less", repetition_count=4, review_count=7,
                                interval_days=12, last_reviewed_at=now - timedelta(days=12), due_at=due)
        Progress.objects.create(user_id=user.id, source_language="english", target_language="german",
                                pattern_key="german_prefix_un", due_at=now)
        with connection.schema_editor() as schema:
            module.migrate_patterns(state.apps, schema)
        reviewed = Item.objects.get(pattern_key="english_suffix_less")
        assert reviewed.user_id == user.id
        assert reviewed.german_text == "-less"
        assert reviewed.review_count_es_to_de == 7
        assert reviewed.repetition_count_es_to_de == 4
        assert reviewed.interval_days_es_to_de == 12
        assert reviewed.due_at_es_to_de == due
        assert reviewed.last_reviewed_at_es_to_de == now - timedelta(days=12)
        assert reviewed.review_count_de_to_es == reviewed.repetition_count_de_to_es == 0
        assert reviewed.interval_days_de_to_es == 1
        assert reviewed.due_at_de_to_es == due + timedelta(days=1)
        pending = Item.objects.get(pattern_key="german_prefix_un")
        assert pending.german_text == "un-"
        assert pending.last_reviewed_at_es_to_de is None and pending.last_reviewed_at_de_to_es is None
    finally:
        with connection.schema_editor() as schema:
            schema.delete_model(Progress)
