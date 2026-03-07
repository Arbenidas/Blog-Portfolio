import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

import 'prismjs';
import 'prismjs/components/prism-typescript.min.js';
import 'prismjs/components/prism-javascript.min.js';
import 'prismjs/components/prism-css.min.js';
import 'prismjs/components/prism-scss.min.js';
import 'prismjs/components/prism-json.min.js';
import 'prismjs/components/prism-bash.min.js';
import 'prismjs/components/prism-java.min.js';
import 'prismjs/components/prism-properties.min.js';
import 'prismjs/components/prism-markdown.min.js';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
