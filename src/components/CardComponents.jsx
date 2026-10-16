// Adapted from dyte-io/docs src/components/CardComponents.tsx (Apache-2.0)
import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function CardSection({
  id,
  title,
  children,
  description,
  className,
  hasSubSections = false,
  HeadingTag = 'h3',
}) {
  return (
    <div
      className={clsx(
        'homepage-section',
        hasSubSections && 'has-sub-sections',
        className,
      )}
    >
      {title && <HeadingTag id={id ?? slug(title)}>{title}</HeadingTag>}
      {description && <p className="section-description">{description}</p>}
      <div className="section-content">{children}</div>
    </div>
  );
}

export function Card({ id, icon, title, description, to, className }) {
  return (
    <Link to={to} className={clsx('homepage-card', className)}>
      {icon && <div className="icon">{icon}</div>}
      <div className="card-content">
        <div className="title" id={id && slug(title)}>
          {title}
        </div>
        {description && <div className="description">{description}</div>}
      </div>
    </Link>
  );
}
