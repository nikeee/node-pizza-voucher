# node-pizza-voucher [![Build Status](https://travis-ci.org/nikeee/node-pizza-voucher.svg?branch=master)](https://travis-ci.org/nikeee/node-pizza-voucher)
Redeem and list pizza.de voucher codes via the command line.

## Archived as of 2019-05-18
pizza.de is now part of takeaway.com and may use different vouchers. This repository is therefore useless now.

## Requirements
- Node.js with native promises
- For development: TypeScript 2.1 / Dev-Dependencies

## Global Installation
```Shell
# npm install -g pizza-voucher # as root
$ pizza-voucher --help
```

## Usage
```Shell
# list vouchers
pizza-voucher list -u <user> -p <password>

# redeem (and list) vouchers
pizza-voucher redeem -u <user> -p <password> -v <voucher code>
```

Full help:
```Shell
$ pizza-voucher
Commands:
  redeem  Redeem a pizza.de voucher code.
  list    List current available vouchers.                                        [aliases: ls]

$ pizza-voucher list
Options:
  --help          Show help                                                           [boolean]
  -u, --user      pizza.de user name                                        [string] [required]
  -p, --password  pizza.de password; will be prompted if not provided  [string] [default: null]

$ pizza-voucher redeem
Options:
  --help          Show help                                                          [boolean]
  -v, --voucher   pizza.de voucher code to redeem                          [string] [required]
  -u, --user      pizza.de user name                                       [string] [required]
  -p, --password  pizza.de password; will be prompted if not provided [string] [default: null]
```
**If `-p` is not set, it will be prompted.**

## Build
```Shell
git clone https://github.com/nikeee/node-pizza-voucher
cd node-pizza-voucher/
npm i
tsc
```
