#!/bin/bash


git log --pretty=format:"%ar , \"%s %d\"," --no-merges --decorate=short > git-commits.csv
