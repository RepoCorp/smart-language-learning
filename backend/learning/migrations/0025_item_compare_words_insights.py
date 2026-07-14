from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0024_disabledelevenlabsvoice"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="compare_words_insights",
            field=models.TextField(blank=True),
        ),
    ]
