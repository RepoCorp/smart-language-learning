from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("learning", "0029_item_plural_german")]

    operations = [
        migrations.AddField(
            model_name="saveddialog",
            name="proficiency_level",
            field=models.CharField(default="A2", max_length=2),
        ),
    ]
