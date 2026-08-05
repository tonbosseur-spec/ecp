#!/bin/bash
awk '
/TUILE 5: Du nouveau/ {
    in_tuile5 = 1
    tuile5 = "            {/* TUILE 1: Du nouveau */}\n"
    next
}
in_tuile5 == 1 && /<\/Link>/ {
    tuile5 = tuile5 $0 "\n"
    in_tuile5 = 0
    next
}
in_tuile5 == 1 {
    tuile5 = tuile5 $0 "\n"
    next
}
/TUILE 1: Gestion de formations/ {
    print tuile5
    print "            {/* TUILE 2: Gestion de formations */}"
    next
}
/TUILE 2: Gestion clients/ {
    print "            {/* TUILE 3: Gestion clients */}"
    next
}
/TUILE 3: Espace Hub/ {
    print "            {/* TUILE 4: Espace Hub */}"
    next
}
/TUILE 4: Ajouter un formateur/ {
    print "            {/* TUILE 5: Ajouter un formateur */}"
    next
}
{
    print $0
}
' src/pages/Dashboard.tsx > src/pages/Dashboard_new.tsx
mv src/pages/Dashboard_new.tsx src/pages/Dashboard.tsx
