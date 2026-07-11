from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0023_item_confusing_with"),
    ]

    operations = [
        migrations.CreateModel(
            name="DisabledElevenLabsVoice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("voice_id", models.CharField(max_length=120, unique=True)),
                ("voice_name", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ("voice_name", "voice_id"),
            },
        ),
    ]
