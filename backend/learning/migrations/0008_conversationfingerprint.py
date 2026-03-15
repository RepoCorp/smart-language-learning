from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0007_savedtopiccontext"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConversationFingerprint",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("first_line", models.CharField(max_length=255)),
                ("keywords", models.CharField(blank=True, max_length=500)),
                ("fingerprint", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
    ]
