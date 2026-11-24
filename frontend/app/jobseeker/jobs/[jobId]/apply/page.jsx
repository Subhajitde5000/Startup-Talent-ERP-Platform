'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn, SafetyStrip } from '@/components/jobseeker-ui';
import {
  api,
  useCareerResource,
  jobView,
  ResourceState,
  Pagination,
  errorLabel,
  Unavailable,
} from '@/components/career-data';
import { ApiError } from '@/lib/api/client';

export default function JobApplyPage() {
  const params = useParams();
  const rawId = params?.jobId;
  const resource = useCareerResource(`apply:${rawId}`, async (signal) => {
    const [job, context] = await Promise.all([
      api.careers.job(rawId, true, signal),
      api.careers.context(rawId, signal),
    ]);
    return { job, context };
  });
  const job = resource.data ? jobView(resource.data.job) : null;
  const context = resource.data?.context;
  const [step, setStep] = useState(1);
  const [fileOffset, setFileOffset] = useState(0);
  const files = useCareerResource(`personal-resumes:${fileOffset}`, (signal) =>
    api.files.listPersonal(
      { kind: 'resume', limit: 20, offset: fileOffset },
      signal
    )
  );
  const [selectedResume, setSelectedResume] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    portfolio: '',
    linkedin: '',
    github: '',
    salaryExpectation: '',
    currency: 'INR',
    coverNote: '',
  });
  const [answers, setAnswers] = useState({});
  const [accuracy, setAccuracy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const locked = useRef(false);
  useEffect(() => {
    if (context)
      setFormData((v) => ({
        ...v,
        fullName: context.contact.name,
        email: context.contact.email,
        phone: context.contact.phone || '',
        portfolio: context.contact.portfolio_url || '',
        linkedin: context.contact.linkedin_url || '',
        github: context.contact.github_url || '',
      }));
  }, [context]);
  const handleInputChange = (e) =>
    setFormData((v) => ({ ...v, [e.target.name]: e.target.value }));
  const fieldError = (key) =>
    errors[key] ? (
      <p
        id={`error-${key}`}
        role="alert"
        className="mt-1 text-xs text-rose-700"
      >
        {errors[key]}
      </p>
    ) : null;
  const handleNext = (e) => {
    e.preventDefault();
    setStep((v) => Math.min(4, v + 1));
  };
  const handleBack = (e) => {
    e.preventDefault();
    setStep((v) => Math.max(1, v - 1));
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setUploadMessage('');
    try {
      const saved = await api.files.uploadPersonal('resume', file);
      if (saved.upload_status === 'ready' && saved.scan_status === 'clean') {
        setSelectedResume(saved);
        setUploadMessage('Resume uploaded and selected.');
      } else
        setUploadMessage(
          'Upload received. Select it only after processing and a clean scan. Refresh the list to check its status.'
        );
      files.reload();
    } catch (error) {
      setUploadMessage(errorLabel(error));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step !== 4 || locked.current || !context?.can_apply) return;
    locked.current = true;
    setIsSubmitting(true);
    setErrors({});
    setSubmitError('');
    try {
      const result = await api.careers.submit(rawId, {
        contact: {
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone || null,
          portfolio_url: formData.portfolio || null,
          linkedin_url: formData.linkedin || null,
          github_url: formData.github || null,
        },
        resume_file_id: selectedResume?.id || null,
        cover_note: formData.coverNote || null,
        salary_expectation: formData.salaryExpectation || null,
        currency: formData.currency,
        screening_answers: Object.entries(answers)
          .filter(([, v]) => v !== '')
          .map(([key, value]) => ({ key, value })),
        accuracy_confirmed: accuracy,
        consent_share: consent,
      });
      setSubmitted(result);
    } catch (error) {
      setSubmitError(errorLabel(error));
      const mapped = {};
      if (error instanceof ApiError && Array.isArray(error.details))
        for (const detail of error.details) {
          const path = (detail.loc || []).filter((v) => v !== 'body').join('.');
          mapped[path] = detail.msg;
        }
      setErrors(mapped);
      const keys = Object.keys(mapped);
      if (keys.some((k) => k === 'resume_file_id')) setStep(1);
      else if (
        keys.some(
          (k) =>
            k.startsWith('contact') ||
            k.startsWith('cover_note') ||
            k.startsWith('screening_answers')
        )
      )
        setStep(2);
      else if (
        keys.some((k) => k.startsWith('salary_expectation') || k === 'currency')
      )
        setStep(3);
    } finally {
      locked.current = false;
      setIsSubmitting(false);
    }
  };

  if (!job || !context)
    return (
      <JobSeekerShell active="Jobs" liveData>
        <ResourceState resource={resource} />
      </JobSeekerShell>
    );
  if (!context.can_apply && !submitted)
    return (
      <JobSeekerShell active="Jobs" liveData>
        <div role="status" className="rounded-xl border bg-white p-6 space-y-4">
          <p>{context.ineligible_reason}</p>
          {context.existing_application_id && (
            <Link
              href={`/jobseeker/applications/${context.existing_application_id}`}
            >
              <JobBtn primary>View application</JobBtn>
            </Link>
          )}
          <Link href={`/jobseeker/jobs/${job.id}`}>Back to job</Link>
        </div>
      </JobSeekerShell>
    );

  return (
    <JobSeekerShell active="Jobs" liveData>
      <div className="space-y-6 max-w-4xl pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href={`/jobseeker/jobs/${job.id}`}
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to Job Details
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">Apply</span>
        </nav>

        {/* Application Header */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-semibold text-[#806236] tracking-wider block mb-1">
                Job Application
              </span>
              <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                Applying to {job.title}
              </h1>
              <p className="text-xs md:text-sm text-[#4A5568] mt-1">
                at{' '}
                <span className="font-semibold text-[#0F1B2D]">
                  {job.company?.name || job.company}
                </span>{' '}
                · {job.loc} · {job.salary}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] px-4 py-2 text-right">
              <span className="text-xs text-[#6B7280] block">Step</span>
              <span className="text-base font-bold text-[#0F1B2D]">
                {step} of 4
              </span>
            </div>
          </div>

          {/* Stepper progress */}
          <div className="mt-6 flex items-center justify-between gap-2 border-t border-[#F0EBE0] pt-4">
            {[
              { num: 1, label: 'Resume' },
              { num: 2, label: 'Details' },
              { num: 3, label: 'Preferences' },
              { num: 4, label: 'Review' },
            ].map((s) => (
              <div
                key={s.num}
                className="flex-1 flex flex-col items-center sm:items-start"
              >
                <div className="flex items-center gap-2 w-full">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      step > s.num
                        ? 'bg-[#286749] text-white'
                        : step === s.num
                          ? 'bg-[#0F1B2D] text-white'
                          : 'bg-[#F0EBE0] text-[#6B7280]'
                    }`}
                  >
                    {step > s.num ? <Check size={14} /> : s.num}
                  </span>
                  <div
                    className={`hidden sm:block h-1 flex-1 rounded-full ${
                      step > s.num ? 'bg-[#286749]' : 'bg-[#E5E1D8]'
                    }`}
                  />
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium hidden sm:block ${
                    step === s.num
                      ? 'text-[#0F1B2D] font-bold'
                      : 'text-[#6B7280]'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </header>

        {submitted ? (
          <div className="rounded-2xl border border-[#CDE5D7] bg-[#E7F3EC]/30 p-8 text-center space-y-4">
            <span className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-[#E7F3EC] text-[#286749]">
              <CheckCircle2 size={36} />
            </span>
            <h2 className="text-2xl font-serif font-bold text-[#0F1B2D]">
              Application Submitted Successfully!
            </h2>
            <p className="text-sm text-[#4A5568] max-w-lg mx-auto leading-relaxed">
              Your contact details, profile snapshot, selected materials, and
              answers have been shared with {job.company?.name || job.company}.
            </p>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <Link href={`/jobseeker/applications/${submitted?.id}`}>
                <JobBtn primary className="px-5">
                  Track in Applications <ArrowRight size={14} />
                </JobBtn>
              </Link>
              <Link href="/jobseeker/jobs">
                <JobBtn secondary small>
                  Search More Jobs
                </JobBtn>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {submitError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-700"
              >
                {submitError}
              </div>
            )}
            {step === 1 && (
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
                <h2 className="font-serif font-bold">
                  1. Select Your Application Resume
                </h2>
                <p className="text-xs text-[#6B7280]">
                  A resume is optional. Only your personal, ready, clean files
                  can be shared.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="resume"
                    checked={!selectedResume}
                    onChange={() => setSelectedResume(null)}
                  />
                  Apply without a resume
                </label>
                {selectedResume && (
                  <p className="text-xs">
                    Selected: {selectedResume.file_name}
                  </p>
                )}
                <ResourceState
                  resource={files}
                  empty={!files.data?.items.length}
                  emptyLabel="No personal resume files yet. You can continue without one."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {files.data?.items.map((file) => (
                    <label
                      key={file.id}
                      className="rounded-xl border border-[#E5E1D8] p-4 text-xs space-x-2"
                    >
                      <input
                        type="radio"
                        name="resume"
                        checked={selectedResume?.id === file.id}
                        disabled={
                          file.upload_status !== 'ready' ||
                          file.scan_status !== 'clean'
                        }
                        onChange={() => setSelectedResume(file)}
                      />
                      <span>
                        {file.file_name} · {file.upload_status} /{' '}
                        {file.scan_status}
                      </span>
                    </label>
                  ))}
                </div>
                <Pagination page={files.data} onChange={setFileOffset} />
                <label className="block text-xs font-semibold">
                  {uploading
                    ? 'Uploading…'
                    : 'Upload a personal resume (PDF/DOCX, up to 10 MiB)'}
                  <input
                    aria-label="Upload personal resume"
                    type="file"
                    accept=".pdf,.docx"
                    disabled={uploading}
                    onChange={upload}
                    className="block mt-2"
                  />
                </label>
                <JobBtn secondary small onClick={files.reload}>
                  Refresh resume list
                </JobBtn>
                {uploadMessage && (
                  <p role="status" className="text-xs">
                    {uploadMessage}
                  </p>
                )}
                {fieldError('resume_file_id')}
                <Unavailable>
                  Builder resumes, tailoring and ATS scores
                </Unavailable>
              </section>
            )}

            {/* Step 2: Contact & Screening Details */}
            {step === 2 && (
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
                <div>
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    2. Contact Information & Screening Questions
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Information shared directly with the hiring team upon
                    submission.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-xs font-semibold text-[#4A5568] mb-1"
                    >
                      Full Legal Name
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      aria-invalid={Boolean(errors['contact.name'])}
                      aria-describedby="error-contact.name"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    {fieldError('contact.name')}
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-semibold text-[#4A5568] mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      aria-invalid={Boolean(errors['contact.email'])}
                      aria-describedby="error-contact.email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    {fieldError('contact.email')}
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-xs font-semibold text-[#4A5568] mb-1"
                    >
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      aria-invalid={Boolean(errors['contact.phone'])}
                      aria-describedby="error-contact.phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    {fieldError('contact.phone')}
                  </div>
                  <div>
                    <label
                      htmlFor="portfolio"
                      className="block text-xs font-semibold text-[#4A5568] mb-1"
                    >
                      Portfolio URL (HTTPS)
                    </label>
                    <input
                      id="portfolio"
                      name="portfolio"
                      type="url"
                      aria-invalid={Boolean(errors['contact.portfolio_url'])}
                      aria-describedby="error-contact.portfolio_url"
                      value={formData.portfolio}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    {fieldError('contact.portfolio_url')}
                  </div>
                  {['linkedin', 'github'].map((name) => (
                    <div key={name}>
                      <label
                        htmlFor={name}
                        className="block text-xs font-semibold text-[#4A5568] mb-1"
                      >
                        {name === 'linkedin' ? 'LinkedIn' : 'GitHub'} URL
                        (HTTPS)
                      </label>
                      <input
                        id={name}
                        name={name}
                        value={formData[name]}
                        onChange={handleInputChange}
                        aria-invalid={Boolean(errors[`contact.${name}_url`])}
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs"
                      />
                      {fieldError(`contact.${name}_url`)}
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-3 border-t border-[#F0EBE0]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                    Cover Note & Screening Questions
                  </h3>
                  <div>
                    <label
                      htmlFor="coverNote"
                      className="block text-xs font-semibold text-[#4A5568] mb-1"
                    >
                      Why do you want to join {job.company?.name || job.company}
                      ?
                    </label>
                    <textarea
                      id="coverNote"
                      aria-invalid={Boolean(errors.cover_note)}
                      aria-describedby="error-cover_note"
                      name="coverNote"
                      rows={3}
                      maxLength={1000}
                      value={formData.coverNote}
                      onChange={handleInputChange}
                      className="w-full p-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    {fieldError('cover_note')}
                  </div>{' '}
                  {context.questions.map((q) => (
                    <div key={q.key}>
                      <label
                        htmlFor={q.key}
                        className="block text-xs font-semibold mb-1"
                      >
                        {q.prompt} {q.required ? '(required)' : '(optional)'}
                      </label>
                      {q.type === 'text' ? (
                        <textarea
                          id={q.key}
                          maxLength={1000}
                          value={answers[q.key] ?? ''}
                          onChange={(e) =>
                            setAnswers((v) => ({
                              ...v,
                              [q.key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border p-3 text-xs"
                        />
                      ) : (
                        <select
                          id={q.key}
                          value={
                            typeof answers[q.key] === 'boolean'
                              ? String(answers[q.key])
                              : (answers[q.key] ?? '')
                          }
                          onChange={(e) =>
                            setAnswers((v) => ({
                              ...v,
                              [q.key]:
                                q.type === 'boolean' && e.target.value
                                  ? e.target.value === 'true'
                                  : e.target.value,
                            }))
                          }
                          className="w-full h-10 px-3 rounded-lg border text-xs"
                        >
                          <option value="">Choose an answer</option>
                          {q.type === 'boolean' ? (
                            <>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </>
                          ) : (
                            q.options.map((option) => (
                              <option key={option} value={option}>
                                {option.replaceAll('_', ' ')}
                              </option>
                            ))
                          )}
                        </select>
                      )}
                    </div>
                  ))}
                  {Object.keys(errors)
                    .filter((k) => k.startsWith('screening_answers'))
                    .map((k) => (
                      <React.Fragment key={k}>{fieldError(k)}</React.Fragment>
                    ))}
                </div>
              </section>
            )}

            {/* Step 3: Preferences & Disclosures */}
            {step === 3 && (
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
                <div>
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    3. Compensation & Availability
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Align expectations early to streamline the founder review
                    process.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="salaryExpectation"
                      className="block text-xs font-semibold text-[#4A5568] mb-1"
                    >
                      Annual Salary Expectation (CTC)
                    </label>
                    <input
                      id="salaryExpectation"
                      aria-invalid={Boolean(errors.salary_expectation)}
                      aria-describedby="error-salary_expectation"
                      name="salaryExpectation"
                      type="text"
                      value={formData.salaryExpectation}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    {fieldError('salary_expectation')}
                    <p className="text-xs text-[#6B7280]">
                      Optional annual expectation, in full currency units (for
                      example 1800000.50).
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="currency"
                      className="block text-xs font-semibold mb-1"
                    >
                      Currency (ISO code)
                    </label>
                    <input
                      id="currency"
                      aria-invalid={Boolean(errors.currency)}
                      aria-describedby="error-currency"
                      name="currency"
                      maxLength={3}
                      value={formData.currency}
                      onChange={handleInputChange}
                      className="w-full h-10 px-3 rounded-lg border text-xs"
                    />
                    {fieldError('currency')}
                  </div>
                </div>

                <SafetyStrip liveData />
              </section>
            )}

            {/* Step 4: Final Review */}
            {step === 4 && (
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
                <div>
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    4. Review Your Application
                  </h2>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Verify all information before final submission.
                  </p>
                </div>

                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs space-y-3">
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <span className="text-[#6B7280]">Role & Company:</span>
                    <strong className="text-[#0F1B2D]">
                      {job.title} at {job.company?.name || job.company}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <span className="text-[#6B7280]">Selected Resume:</span>
                    <strong className="text-[#0F1B2D]">
                      {selectedResume?.file_name || 'No resume attached'}
                    </strong>
                  </div>
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <span className="text-[#6B7280]">Applicant:</span>
                    <span className="text-[#0F1B2D]">
                      {formData.fullName} ({formData.email})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <span className="text-[#6B7280]">Expected CTC:</span>
                    <span className="text-[#0F1B2D]">
                      {formData.salaryExpectation
                        ? `${formData.currency} ${formData.salaryExpectation}`
                        : 'Not provided'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Availability:</span>
                    <span className="text-[#0F1B2D]">
                      {context.questions.find((q) => q.key === 'notice_period')
                        ? answers.notice_period || 'Not answered'
                        : 'Not requested'}
                    </span>
                  </div>
                </div>

                <dl className="space-y-2 text-xs">
                  <dt>Contact links and phone</dt>
                  <dd>
                    {[
                      formData.phone,
                      formData.portfolio,
                      formData.linkedin,
                      formData.github,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'None provided'}
                  </dd>
                  <dt>Cover note</dt>
                  <dd className="whitespace-pre-wrap">
                    {formData.coverNote || 'Not provided'}
                  </dd>
                  {context.questions.map((q) => (
                    <React.Fragment key={q.key}>
                      <dt>{q.prompt}</dt>
                      <dd>
                        {typeof answers[q.key] === 'boolean'
                          ? answers[q.key]
                            ? 'Yes'
                            : 'No'
                          : answers[q.key] || 'Not answered'}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
                <dl className="rounded-xl border border-[#E5E1D8] p-4 space-y-2 text-xs">
                  <dt>Current profile headline</dt>
                  <dd>{context.profile.headline || 'Not provided'}</dd>
                  <dt>Summary</dt>
                  <dd className="whitespace-pre-wrap">
                    {context.profile.summary || 'Not provided'}
                  </dd>
                  <dt>Experience / location</dt>
                  <dd>
                    {context.profile.experience_years ?? 'Not provided'} years ·{' '}
                    {context.profile.current_location || 'Not provided'}
                  </dd>
                  <dt>Skills</dt>
                  <dd>
                    {context.profile.skills.join(', ') || 'None provided'}
                  </dd>
                </dl>
                <p className="text-xs text-[#6B7280]">
                  Your current profile headline, summary, experience, location
                  and skills are snapshotted by the server on submission. This
                  form is not saved as a draft.
                </p>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={accuracy}
                    onChange={(e) => setAccuracy(e.target.checked)}
                  />
                  I confirm the information is accurate.
                </label>
                {fieldError('accuracy_confirmed')}
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I consent to share my submitted contact details, profile
                  snapshot, selected resume and answers with this employer.
                </label>
                {fieldError('consent_share')}
              </section>
            )}

            {/* Stepper Controls */}
            <div className="flex items-center justify-between pt-2">
              {step > 1 ? (
                <JobBtn
                  secondary
                  onClick={handleBack}
                  small
                  className="flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back
                </JobBtn>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <JobBtn
                  key="continue"
                  primary
                  onClick={handleNext}
                  small
                  className="flex items-center gap-1.5"
                >
                  Continue <ArrowRight size={14} />
                </JobBtn>
              ) : (
                <JobBtn
                  key="submit"
                  type="submit"
                  primary
                  disabled={isSubmitting || uploading}
                  className="px-6 min-h-[42px]"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </JobBtn>
              )}
            </div>
          </form>
        )}
      </div>
    </JobSeekerShell>
  );
}
