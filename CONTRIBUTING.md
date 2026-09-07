# Contributing

Thanks for looking. Here is what helps and what does not.

## Issues, yes

Bug reports are genuinely useful, and the more concrete the better: the command
you ran, what you expected, what happened instead. If it involves a specific
chat or message, say which kind, not which one.

Feature requests are welcome too, with one caveat worth setting out. The tool
list is deliberately small. Every tool is sent to the model on every turn, so
each one costs context whether it gets used or not, and a server with 80 tools
is worse than one with 13 because the model picks badly from 80. Most additions
land in the `full` profile or the CLI rather than in `core`, and some get
declined for that reason rather than because the idea is bad.

## Pull requests, no

This is one of a family of servers that are deliberately identical to each
other in structure. A change that makes sense here alone tends to make the
family inconsistent, and keeping them the same is worth more than any single
improvement.

Open an issue instead. If it belongs in, it gets written in the shape the rest
of the family uses.
