from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0012_dialogturn_itemdialogoccurrence"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="is_learned",
            field=models.BooleanField(default=False),
        ),
    ]
