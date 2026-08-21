import React from 'react';
import { useParams } from 'react-router-dom';
import AdminEbookWizard from '../components/AdminEbookWizard';

export default function EditEbook() {
  const { id } = useParams();
  return <AdminEbookWizard ebookId={id} />;
}
