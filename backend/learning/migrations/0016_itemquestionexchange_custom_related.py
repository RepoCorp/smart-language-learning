from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0015_itemquestionexchange"),
    ]

    operations = [
        migrations.AlterField(
            model_name="itemquestionexchange",
            name="question_type",
            field=models.CharField(
                choices=[
                    ("grammar_explanation", "Grammar explanation"),
                    ("more_examples", "More examples"),
                    ("common_mistakes", "Common mistakes"),
                    ("custom_related", "Custom related question"),
                ],
                max_length=40,
            ),
        ),
    ]
