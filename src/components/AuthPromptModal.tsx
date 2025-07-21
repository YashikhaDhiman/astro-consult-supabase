'use client';

export default function AuthPromptModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
      <div className="bg-white text-black p-6 rounded shadow-lg w-[300px] text-center">
        <h2 className="text-lg font-semibold mb-4">Please log in or sign up</h2>
        <p className="text-sm mb-6">You must be logged in to ask a question.</p>
        <div className="flex justify-around">
          <a href="/login" className="text-blue-600 hover:underline">Login</a>
          <a href="/signup" className="text-blue-600 hover:underline">Sign Up</a>
        </div>
        <button
          onClick={onClose}
          className="mt-4 text-xs text-gray-500 hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}
