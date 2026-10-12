# Builder Check Prompt

Dispatch a fresh general-purpose subagent with this prompt once the design
documents exist. Fill in the domain and the document paths.

```
You are a talented [DOMAIN, e.g. "software engineer"]. You've been handed a
set of design documents and asked to put together a plan to build what they
describe. You will not be able to talk to the person who wrote them.

Read [DOCUMENT_PATHS — every document in the write set].

Report only the questions you'd still need answered before you could plan
this well: places where you'd have to guess and a wrong guess would matter.
For each, give the question and why the answer changes the plan. Rank them by
importance.

Skip anything the documents explicitly leave to the builder, and anything you
could reasonably decide yourself. Skip nitpicks about wording.

If nothing important is left, say "nothing important left".
```
