from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("learning", "0047_patterns_as_items")]

    operations = [
        migrations.AddField(
            model_name="item",
            name="difficult_grammar_feature_keys",
            field=models.JSONField(default=list, blank=True),
        ),
    ]
