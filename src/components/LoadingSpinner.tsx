export default function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="loading-container">
      <div className="spinner" />
      {message && <p className="loading-text">{message}</p>}
    </div>
  );
}
