from django.db import migrations, models
from django.utils import timezone


def mark_existing_phrase_grammar_as_checked(apps, schema_editor):
    Item = apps.get_model("learning", "Item")
    Item.objects.filter(
        item_type="phrase",
        grammar_features__isnull=False,
    ).update(phrase_grammar_checked_at=timezone.now())


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0034_itemgrammarfeature"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="phrase_grammar_checked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(mark_existing_phrase_grammar_as_checked, migrations.RunPython.noop),
    ]
