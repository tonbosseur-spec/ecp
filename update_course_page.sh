#!/bin/bash
awk '
/.font-handwritten {/ {
    skip = 1
    next
}
skip == 1 && /}/ {
    skip = 0
    next
}
skip == 1 {
    next
}
{
    print $0
}
' src/pages/PublicCoursePage.tsx > src/pages/PublicCoursePage_new.tsx
mv src/pages/PublicCoursePage_new.tsx src/pages/PublicCoursePage.tsx
