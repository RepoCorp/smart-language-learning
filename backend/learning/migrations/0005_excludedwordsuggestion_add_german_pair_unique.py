from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0004_excludedwordsuggestion"),
    ]

    operations = [
        migrations.AddField(
            model_name="excludedwordsuggestion",
            name="german_text",
            field=models.CharField(default="", max_length=255),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="excludedwordsuggestion",
            name="spanish_text",
            field=models.CharField(max_length=255),
        ),
        migrations.AddConstraint(
            model_name="excludedwordsuggestion",
            constraint=models.UniqueConstraint(
                fields=("spanish_text", "german_text"),
                name="learning_excludedwordsuggestion_es_de_uniq",
            ),
        ),
    ]
