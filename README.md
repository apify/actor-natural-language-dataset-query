# Tiny Dataset Query Engine

This Actor allows you to run natural language queries against an Apify dataset. For example, if you run a web scraping Actor and want to know how many pages contain a specific keyword, you can ask this Actor to find out for you.

> **ℹ️ Notice:**  
> This Actor internally uses the [Apify Openrouter Actor](https://apify.com/apify/openrouter) to call an LLM. You will be billed for LLM usage through this Actor.

## ⚙️ How does it work?

This Actor uses LLMs to understand your query, generate an SQL statement, and report the results. First, the Actor retrieves the dataset items and builds an internal schema representation, which is converted into an in-memory [SQLite3](https://www.sqlite.org/) database. Then, the LLM generates an SQL query and executes it against the SQLite3 database. Finally, it summarizes the results and returns them to you.

## 🚀 Usage

### 🟢 Normal Actor mode

You can run the Actor "normally" via the Apify API, schedule, integrations, or manually in the Apify Console. At the start, you provide input via the UI or as a JSON object and run the Actor.

>**ℹ️ Notice:**
> This mode is highly inefficient for a large number of queries against a single dataset, as the Actor will always re-fetch the dataset and rebuild the SQLite3 database. For more efficient querying, run the Actor in Standby mode.

### 💤 Standby mode

The Actor supports [Standby mode](https://docs.apify.com/platform/actors/running/standby), where it runs an HTTP server that processes queries on demand. This mode eliminates the need to re-fetch the dataset and rebuild the SQLite3 database for each query against a single dataset, making it much more efficient for multiple queries against the same dataset.

To run the Actor in Standby mode, send an HTTP GET request to the Actor's URL with the following query parameters:
- `dataset`: The ID of the dataset you want to query.
- `query`: The natural language query you want to run against the dataset.
- `modelName`: (optional) The name of the LLM model you want to use for the query. If not provided, the Actor will use the default model defined in the Actor input. See the Actor input schema for a list of available models.

```text
https://jakub-kopecky--tiny-dataset-query-engine.apify.actor/?token=YOUR_APIFY_TOKEN&dataset=DATASET_ID&query=YOUR_QUERY
```

## 💸 Pricing

This Actor charges you for Apify platform compute and LLM usage, depending on the model you choose. You can verify the LLM model pricing on [OpenRouter](https://openrouter.ai/models). For a simple query, this will cost you around $0.007 per normal Actor run.
