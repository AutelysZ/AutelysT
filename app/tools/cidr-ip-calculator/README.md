# CIDR/IP Calculator

Calculate IPv4 and IPv6 subnet details, including ranges, netmasks, and host counts, with an optional inclusion check.

## Features

- Parse IPv4/IPv6 addresses with optional CIDR prefixes
- Compute network, broadcast, first/last usable, and range boundaries
- Show netmask and wildcard for IPv4 subnets
- Calculate total and usable address counts
- Check whether an IP is inside the subnet
- Convert IPv4 netmask ↔ prefix

## Parameters

- CIDR or IP input
- Default IPv4 prefix length
- Default IPv6 prefix length
- Optional check IP
- Netmask input (for prefix conversion)
- Prefix input (for netmask conversion)

## URL State

- Inputs and parameters are synced to the URL hash for sharing
- Output-only fields are excluded from URL sync

## History

- Input edits create history entries
- Parameter changes update the latest entry
