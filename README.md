# BUZZLAB

CSV / JSON ファイルから問題セットを作り、1人または2人で遊べるブラウザ完結型の早押しクイズです。

## CSV 形式

必須列は `question`, `answer`, `choice1`, `choice2`, `choice3` です。任意で `set_title`, `category`, `explanation`, `aliases` を指定できます。別解は `aliases` 内で `|` 区切りにします。

## JSON 形式

```json
{
  "title": "サンプルクイズ",
  "questions": [
    {
      "category": "地理",
      "question": "日本の首都はどこ？",
      "answer": "東京",
      "choices": ["大阪", "京都", "札幌"],
      "explanation": "東京は日本の首都です。",
      "aliases": ["東京都", "とうきょう"]
    }
  ]
}
```

読み込んだ問題セットはブラウザのローカルストレージに保存されます。
