/** Components available inside case-study MDX (passed as `components` to <Content />). */
import CaseLink from './CaseLink.astro';
import Callout from './Callout.astro';
import Challenge from './Challenge.astro';
import Decision from './Decision.astro';
import Diagram from './Diagram.astro';
import Figure from './Figure.astro';
import Metrics from './Metrics.astro';
import Section from './Section.astro';

export const caseStudyComponents = {
  a: CaseLink,
  Callout,
  Challenge,
  Decision,
  Diagram,
  Figure,
  Metrics,
  Section,
};
