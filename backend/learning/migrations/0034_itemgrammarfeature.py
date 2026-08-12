from django.db import migrations, models


GERMAN_NOUN_GENDER_BY_ARTICLE = {
    "der": "german.noun.gender.masculine",
    "die": "german.noun.gender.feminine",
    "das": "german.noun.gender.neuter",
}


def backfill_german_noun_gender_features(apps, schema_editor):
    Item = apps.get_model("learning", "Item")
    ItemGrammarFeature = apps.get_model("learning", "ItemGrammarFeature")
    links = []
    for item in Item.objects.filter(item_type="word", target_language="german", word_type="noun").only("id", "german_text"):
        article = (item.german_text or "").strip().split(" ", 1)[0].lower()
        feature_key = GERMAN_NOUN_GENDER_BY_ARTICLE.get(article)
        if feature_key:
            links.append(ItemGrammarFeature(item_id=item.id, feature_key=feature_key))
    ItemGrammarFeature.objects.bulk_create(links, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [("learning", "0033_dailylearningprogress_active_seconds_by_language")]

    operations = [
        migrations.CreateModel(
            name="ItemGrammarFeature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("feature_key", models.CharField(max_length=100)),
                ("item", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="grammar_features", to="learning.item")),
            ],
        ),
        migrations.AddConstraint(
            model_name="itemgrammarfeature",
            constraint=models.UniqueConstraint(fields=("item", "feature_key"), name="learning_item_grammar_feature_uniq"),
        ),
        migrations.RunPython(backfill_german_noun_gender_features, migrations.RunPython.noop),
    ]
