#!/bin/bash
awk '
/@theme {/ {
    print $0
    print "  --font-sans: \"Geist\", sans-serif;"
    print "  --font-heading: \"Manrope\", sans-serif;"
    next
}
/@layer base {/ {
    print $0
    print "  h1, h2, h3, h4, h5, h6 {"
    print "    font-family: var(--font-heading) !important;"
    print "  }"
    print "  body {"
    print "    font-family: var(--font-sans) !important;"
    print "  }"
    next
}
{
    print $0
}
' src/index.css > src/index_new.css
mv src/index_new.css src/index.css
