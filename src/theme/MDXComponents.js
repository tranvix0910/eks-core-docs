// Same pattern as dyte-io/docs src/theme/MDXComponents.js (Apache-2.0)
import MDXComponents from '@theme-original/MDXComponents';
import { CardSection, Card } from '../components/CardComponents';
import * as icons from '../icons';

export default {
  ...MDXComponents,
  ...icons,
  CardSection,
  Card,
};
