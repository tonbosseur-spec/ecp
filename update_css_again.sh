#!/bin/bash
awk '
/--font-sans: "Geist", sans-serif;/ {
    print $0
    print "  --font-serif: \"Geist\", sans-serif;"
    print "  --font-mono: \"Geist\", sans-serif;"
    next
}
{
    print $0
}
' src/index.css > src/index_new2.css
mv src/index_new2.css src/index.css
