from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0028_alter_item_source_language_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="plural_german",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
