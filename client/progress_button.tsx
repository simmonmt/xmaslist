import Button, { ButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { styled } from "@mui/material/styles";
import * as React from "react";

interface ProgressButtonProps {
  updating: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

const Wrapper = styled("div")({
  position: "relative",
});

const ButtonProgress = styled(CircularProgress)({
  position: "absolute",
  top: "50%",
  left: "50%",
  marginTop: -12,
  marginLeft: -12,
});

export class ProgressButton extends React.Component<
  ProgressButtonProps & ButtonProps
> {
  render() {
    // v4 Buttons defaulted to the text color rather than the primary color.
    const {
      updating,
      disabled,
      children,
      color = "inherit",
      ...rest
    } = this.props;

    return (
      <Wrapper>
        <Button disabled={disabled || updating} color={color} {...rest}>
          {children}
        </Button>
        {updating && <ButtonProgress size={24} />}
      </Wrapper>
    );
  }
}
