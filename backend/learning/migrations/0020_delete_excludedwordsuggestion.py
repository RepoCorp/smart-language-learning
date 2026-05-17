from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0019_item_word_type"),
    ]

    operations = [
        migrations.DeleteModel(
            name="ExcludedWordSuggestion",
        ),
    ]
