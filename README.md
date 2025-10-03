# Ketryx Traceability Board (Example)

Linking objects should be much easier in the Ketryx app — this project is an example of how it should be done.

Before
![Demo](before.jpg)

After
![Demo](after.jpg)

You can test it out here:
https://athensf.github.io/ket-2/


This lightweight, front-end prototype demonstrates a streamlined workflow for linking requirements (RQ) to validation test cases (TC) using a Trello-style board. It focuses on clarity, instant visual feedback, and quick actions that reduce friction when establishing and reviewing traceability.

## Overview
- Requirements appear in the Design Input column; related Test Cases live in the Validation column of the same row.
- Drag and drop of cards - like what you would experience in Trello (which most of your users use if they are using Jira)
- A Suggest flow moves relevant TCs into position temporarily, showing exactly what changes would occur.
- Users Accept or Reject suggestions, with unobtrusive, persistent indicators to make differences obvious.

## Why this approach feels better
- Immediate visual feedback (thin diff bars) shows what’s added/removed.
- Ghost placeholders remain where items moved from, keeping context.
- A brief Suggesting state provides clear UX affordance before actions appear.
- Reset returns to a known clean state for repeatable demos and testing.


