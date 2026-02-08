# Unicode Normalizer

Normalize Unicode text and inspect possible spoofing/confusable risks.

## Features

- NFC/NFD/NFKC/NFKD normalization
- Optional combining-mark stripping
- Code point listing and confusable character detection

## Parameters

- Input text
- Normalization form
- Strip combining marks toggle

## Usage

- Paste text and choose normalization mode
- Review normalized output, code points, and confusables

## URL State

- Inputs/params sync with URL state (hash-based sharing)

## History

- Input changes create debounced entries
- Normalization params update latest history params
