import React from 'react';
import { useParams } from 'react-router-dom';
import AdminCourseWizard from '../components/AdminCourseWizard';

export default function EditCourse() {
  const { id } = useParams();
  return <AdminCourseWizard courseId={id} />;
}
