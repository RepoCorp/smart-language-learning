from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0022_item_difficult_tracking"),
    ]

    operations = [
        migrations.AddField(
            model_name="item",
            name="confusing_with",
            field=models.ManyToManyField(blank=True, to="learning.item"),
        ),
    ]
