import { configure } from '@testing-library/react';

// A busy CI runner can take over the 1s default to build jsdom and render a page's first data.
configure({ asyncUtilTimeout: 5000 });
