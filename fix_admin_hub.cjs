const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminHub.tsx', 'utf-8');

// Fix imports
content = content.replace(
  "import { Loader2, Copy, CheckCircle2, Store, Users, ExternalLink, Calendar, CreditCard, Clock, MessageCircle, Check, X, RefreshCw } from 'lucide-react';",
  "import { Loader2, Copy, CheckCircle2, Store, Users, ExternalLink, Calendar, CreditCard, Clock, MessageCircle, Check, X, RefreshCw, Link as LinkIcon, MessageSquare } from 'lucide-react';"
);

// Fix copyQuizLink if not defined properly inside the component.
// Wait, I inserted copyFunction before handleValidatePayment which is inside AdminHub.
// Let's check where it is.
fs.writeFileSync('src/pages/AdminHub.tsx', content);
