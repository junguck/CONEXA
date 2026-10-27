import 'reflect-metadata';

import { createServiceApp } from '@conexa/service-kit';

import { AppModule } from './app.module.js';

void createServiceApp({ name: 'uploads', module: AppModule });
