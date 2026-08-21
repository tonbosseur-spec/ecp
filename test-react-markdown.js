import React from 'react';
import { renderToString } from 'react-dom/server';
import Markdown from 'react-markdown';

const html = `<div># Bienvenue dans R 👋</div><div><br></div><div>R est un **langage de programmation**...</div>`;

console.log(renderToString(React.createElement(Markdown, null, html)));
