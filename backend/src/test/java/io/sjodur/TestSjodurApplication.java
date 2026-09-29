package io.sjodur;

import org.springframework.boot.SpringApplication;

public class TestSjodurApplication {

    public static void main(String[] args) {
        SpringApplication.from(SjodurApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
