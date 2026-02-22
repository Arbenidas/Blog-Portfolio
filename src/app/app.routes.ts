import { Routes } from '@angular/router';
import { PublicLayout } from './components/public-layout/public-layout';
import { HomeView } from './views/home-view/home-view';
import { WorksDb } from './views/works-db/works-db';
import { CaseStudy } from './views/case-study/case-study';
import { LogsArchive } from './views/logs-archive/logs-archive';
import { FieldLog } from './views/field-log/field-log';
import { ContactTerminal } from './views/contact-terminal/contact-terminal';

import { AdminLayout } from './backoffice/admin-layout/admin-layout';
import { AdminDashboard } from './backoffice/admin-dashboard/admin-dashboard';
import { BlockEditor } from './backoffice/block-editor/block-editor';
import { WorksVaultAdmin } from './backoffice/works-vault/works-vault';
import { LogsArchiveAdmin } from './backoffice/logs-archive/logs-archive';
import { Login } from './backoffice/login/login';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: PublicLayout,
        children: [
            { path: '', component: HomeView, data: { animation: 'Home' } },
            { path: 'works', component: WorksDb, data: { animation: 'Works' } },
            { path: 'works/:slug', component: CaseStudy, data: { animation: 'CaseStudy' } },
            { path: 'logs', component: LogsArchive, data: { animation: 'Logs' } },
            { path: 'logs/:slug', component: FieldLog, data: { animation: 'FieldLog' } },
            { path: 'contact', component: ContactTerminal, data: { animation: 'Contact' } },
        ]
    },
    { path: 'admin/login', component: Login },
    {
        path: 'admin',
        component: AdminLayout,
        canActivate: [AuthGuard],
        children: [
            { path: '', component: AdminDashboard },
            { path: 'works', component: WorksVaultAdmin },
            { path: 'logs', component: LogsArchiveAdmin },
            { path: 'editor', component: BlockEditor },
            { path: 'editor/:id', component: BlockEditor },
        ]
    },
    { path: '**', redirectTo: '' }
];
