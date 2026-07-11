import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

import "../../styles/runtime-safety.css";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(
    error: Error,
  ): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error.message ||
        "An unexpected application error occurred.",
    };
  }

  componentDidCatch(
    error: Error,
    errorInfo: ErrorInfo,
  ): void {
    console.error(
      "Head2Head Brawlin' runtime error",
      error,
      errorInfo,
    );
  }

  private reloadApplication = (): void => {
    window.location.reload();
  };

  private returnHome = (): void => {
    const basePath =
      import.meta.env.BASE_URL?.trim() || "/";

    window.location.assign(basePath);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="runtime-error-screen">
        <section className="runtime-error-card">
          <div className="runtime-error-kicker">
            Steel Edition Recovery
          </div>

          <h1>Something went wrong</h1>

          <p>
            Your saved league information has not
            been intentionally cleared. Reload the
            application before making any additional
            commissioner changes.
          </p>

          <div className="runtime-error-detail">
            <strong>Technical detail</strong>
            <span>{this.state.errorMessage}</span>
          </div>

          <div className="runtime-error-actions">
            <button
              type="button"
              className="runtime-action runtime-action--primary"
              onClick={this.reloadApplication}
            >
              Reload App
            </button>

            <button
              type="button"
              className="runtime-action"
              onClick={this.returnHome}
            >
              Return Home
            </button>
          </div>
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;
