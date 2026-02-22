import { trigger, transition, style, query, animateChild, group, animate } from '@angular/animations';

export const routeAnimations = trigger('routeAnimations', [
    transition('* <=> *', [
        // Ensure the containers position correctly for overlap
        style({ position: 'relative' }),
        query(':enter, :leave', [
            style({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%'
            })
        ], { optional: true }),

        // Start state for entering component
        query(':enter', [
            style({ opacity: 0, transform: 'translateY(15px)' })
        ], { optional: true }),

        // Perform internal child animations on leaving component
        query(':leave', animateChild(), { optional: true }),

        group([
            // Animate leaving component out
            query(':leave', [
                animate('0.3s ease-out', style({ opacity: 0, transform: 'translateY(-15px)' }))
            ], { optional: true }),

            // Animate entering component in
            query(':enter', [
                animate('0.4s 0.1s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
            ], { optional: true })
        ]),

        // Perform internal child animations on entering component
        query(':enter', animateChild(), { optional: true }),
    ])
]);
