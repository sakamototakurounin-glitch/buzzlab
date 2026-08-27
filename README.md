# BUZZLAB

CSV / JSON ファイルから問題セットを作り、1人または2人で遊べるブラウザ完結型の早押しクイズです。早押し後は、正解を1文字ずつ4つの候補から選んで回答します。

## CSV 形式

必須列は `question`, `answer` です。任意で `set_title`, `category`, `explanation` を指定できます。

## JSON 形式

```json
{
  "title": "サンプルクイズ",
  "questions": [
    {
      "category": "地理",
      "question": "日本の首都はどこ？",
      "answer": "東京",
      "explanation": "東京は日本の首都です。"
    }
  ]
}
```

読み込んだ問題セットはブラウザのローカルストレージに保存されます。
